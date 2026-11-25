<?php

namespace Tests\Feature;

use App\Models\Carrier;
use App\Models\Location;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrderApiTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        $user = User::factory()->create();

        $user->forceFill([
            'role' => $role,
        ])->save();

        return $user;
    }

    private function orderData(): array
    {
        $carrier = Carrier::firstOrCreate(
            ['name' => 'Test Sea Carrier'],
            ['mode' => 'Sea freight']
        );

        $origin = Location::firstOrCreate(
            ['name' => 'Test Singapore'],
            [
                'country' => 'Singapore',
                'latitude' => 1.290270,
                'longitude' => 103.851959,
            ]
        );

        $destination = Location::firstOrCreate(
            ['name' => 'Test Jakarta'],
            [
                'country' => 'Indonesia',
                'latitude' => -6.208763,
                'longitude' => 106.845599,
            ]
        );

        return [
            'item_name' => 'Laptop',
            'item_description' => 'Laptop untuk kantor',
            'quantity' => 2,
            'weight_kg' => 2,

            'sender_name' => 'Pengirim Test',
            'sender_phone' => '081234567890',
            'sender_address' => 'Alamat pengirim',
            'origin_id' => $origin->id,

            'recipient_name' => 'Penerima Test',
            'recipient_phone' => '089876543210',
            'recipient_address' => 'Alamat penerima',
            'destination_id' => $destination->id,

            'carrier_id' => $carrier->id,
            'item_value' => 200000,
            'payment_method' => 'TRANSFER',
            'notes' => 'Pesanan pengujian',
        ];
    }

    private function createOrder(User $customer): int
    {
        Sanctum::actingAs($customer);

        $response = $this->postJson(
            '/api/orders',
            $this->orderData()
        );

        $response->assertCreated();

        return (int) $response->json('data.id');
    }

    public function test_customer_can_create_order(): void
    {
        $customer = $this->user('customer');

        Sanctum::actingAs($customer);

        $response = $this->postJson(
            '/api/orders',
            $this->orderData()
        );

        $response->assertCreated()
            ->assertJsonPath('data.order_status', 'PENDING')
            ->assertJsonPath('data.payment_status', 'UNPAID');

        $this->assertNull($response->json('data.shipping_cost'));
        $this->assertNull($response->json('data.total_amount'));

        $this->assertDatabaseHas('orders', [
            'customer_id' => $customer->id,
            'item_name' => 'Laptop',
            'order_status' => 'PENDING',
        ]);
    }

    public function test_customer_only_sees_own_orders(): void
    {
        $customerA = $this->user('customer');
        $customerB = $this->user('customer');

        $orderA = $this->createOrder($customerA);
        $orderB = $this->createOrder($customerB);

        Sanctum::actingAs($customerA);

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->getJson("/api/orders/{$orderA}")
            ->assertOk();

        $this->getJson("/api/orders/{$orderB}")
            ->assertForbidden();
    }

    public function test_customer_cannot_approve_or_reject(): void
    {
        $customer = $this->user('customer');
        $orderId = $this->createOrder($customer);

        $this->postJson("/api/orders/{$orderId}/approve")
            ->assertForbidden();

        $this->postJson("/api/orders/{$orderId}/reject", [
            'reason' => 'Tidak valid',
        ])->assertForbidden();
    }

    public function test_operator_can_approve_order_and_create_shipment(): void
    {
        $customer = $this->user('customer');
        $operator = $this->user('operator');

        $orderId = $this->createOrder($customer);

        Sanctum::actingAs($operator);

        $data = $this->orderData();

        $response = $this->postJson(
            "/api/orders/{$orderId}/approve",
            [
                'carrier_id' => $data['carrier_id'],
                'origin_id' => $data['origin_id'],
                'destination_id' => $data['destination_id'],
            ]
        );

        $response->assertOk()
            ->assertJsonPath('data.order_status', 'APPROVED');

        $shipmentId = $response->json('shipment.id');

        $this->assertNotNull($shipmentId);

        // Pastikan pesanan terhubung dengan shipment.
        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'shipment_id' => $shipmentId,
            'order_status' => 'APPROVED',
        ]);

        // Pastikan shipment benar-benar dibuat dengan status CREATED.
        $this->assertDatabaseHas('shipments', [
            'id' => $shipmentId,
            'customer_id' => $customer->id,
            'status' => 'CREATED',
        ]);

        // Pastikan item pengiriman dibuat.
        $this->assertDatabaseHas('shipment_items', [
            'shipment_id' => $shipmentId,
            'description' => 'Laptop',
            'quantity' => 2,
        ]);

        // Pastikan event tracking awal dibuat.
        $this->assertDatabaseHas('tracking_events', [
            'shipment_id' => $shipmentId,
            'event_type' => 'CREATED',
            'created_by' => $operator->id,
        ]);

        // Pesanan yang sama tidak boleh disetujui dua kali.
        $this->postJson("/api/orders/{$orderId}/approve")
            ->assertStatus(422);

        // Pastikan tidak ada shipment duplikat.
        $this->assertDatabaseCount('shipments', 1);
    }

    public function test_operator_can_reject_pending_order(): void
    {
        $customer = $this->user('customer');
        $operator = $this->user('operator');

        $orderId = $this->createOrder($customer);

        Sanctum::actingAs($operator);

        $this->postJson("/api/orders/{$orderId}/reject", [
            'reason' => 'Alamat pengiriman tidak lengkap',
        ])->assertOk();

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'order_status' => 'REJECTED',
            'shipment_id' => null,
        ]);

        $this->postJson("/api/orders/{$orderId}/approve")
            ->assertStatus(422);
    }

    public function test_customer_can_cancel_pending_order(): void
    {
        $customer = $this->user('customer');

        $orderId = $this->createOrder($customer);

        Sanctum::actingAs($customer);

        $this->postJson("/api/orders/{$orderId}/cancel")
            ->assertOk();

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'order_status' => 'CANCELLED',
        ]);

        $this->postJson("/api/orders/{$orderId}/cancel")
            ->assertStatus(422);
    }

    public function test_admin_can_view_all_orders(): void
    {
        $customerA = $this->user('customer');
        $customerB = $this->user('customer');
        $admin = $this->user('admin');

        $this->createOrder($customerA);
        $this->createOrder($customerB);

        Sanctum::actingAs($admin);

        $this->getJson('/api/orders')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        // Admin tidak membuat pesanan sebagai Customer.
        $this->postJson('/api/orders', $this->orderData())
            ->assertForbidden();
    }

    public function test_orders_require_authentication(): void
    {
        $this->getJson('/api/orders')
            ->assertUnauthorized();
    }

    public function test_customer_can_update_own_pending_order(): void
    {
        $customer = $this->user('customer');
        $orderId = $this->createOrder($customer);

        Sanctum::actingAs($customer);

        $data = array_merge($this->orderData(), [
            'item_name' => 'Laptop Updated',
        ]);

        $this->putJson("/api/orders/{$orderId}", $data)
            ->assertOk()
            ->assertJsonPath('data.item_name', 'Laptop Updated');

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'item_name' => 'Laptop Updated',
        ]);
    }

    public function test_customer_cannot_update_another_customers_order(): void
    {
        $owner = $this->user('customer');
        $otherCustomer = $this->user('customer');
        $orderId = $this->createOrder($owner);

        Sanctum::actingAs($otherCustomer);

        $this->putJson("/api/orders/{$orderId}", $this->orderData())
            ->assertForbidden();
    }

    public function test_admin_and_operator_can_update_pending_orders(): void
    {
        foreach (['admin', 'operator'] as $role) {
            $customer = $this->user('customer');
            $orderId = $this->createOrder($customer);
            $staff = $this->user($role);

            Sanctum::actingAs($staff);

            $data = array_merge($this->orderData(), [
                'item_name' => "Updated by {$role}",
            ]);

            $this->putJson("/api/orders/{$orderId}", $data)
                ->assertOk();

            $this->assertDatabaseHas('orders', [
                'id' => $orderId,
                'item_name' => "Updated by {$role}",
            ]);
        }
    }

    public function test_customer_can_delete_own_pending_order(): void
    {
        $customer = $this->user('customer');
        $orderId = $this->createOrder($customer);

        Sanctum::actingAs($customer);

        $this->deleteJson("/api/orders/{$orderId}")
            ->assertOk();

        $this->assertDatabaseMissing('orders', ['id' => $orderId]);
    }

    public function test_admin_and_operator_can_delete_pending_orders(): void
    {
        foreach (['admin', 'operator'] as $role) {
            $customer = $this->user('customer');
            $orderId = $this->createOrder($customer);
            $staff = $this->user($role);

            Sanctum::actingAs($staff);

            $this->deleteJson("/api/orders/{$orderId}")
                ->assertOk();

            $this->assertDatabaseMissing('orders', ['id' => $orderId]);
        }
    }

    public function test_approved_order_cannot_be_deleted_and_shipment_is_preserved(): void
    {
        $customer = $this->user('customer');
        $operator = $this->user('operator');
        $orderId = $this->createOrder($customer);

        $data = $this->orderData();

        Sanctum::actingAs($operator);

        $approval = $this->postJson("/api/orders/{$orderId}/approve", [
            'carrier_id' => $data['carrier_id'],
            'origin_id' => $data['origin_id'],
            'destination_id' => $data['destination_id'],
        ])->assertOk();

        $shipmentId = $approval->json('shipment.id');

        $admin = $this->user('admin');
        Sanctum::actingAs($admin);

        $this->deleteJson("/api/orders/{$orderId}")
            ->assertStatus(422);

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'shipment_id' => $shipmentId,
        ]);

        $this->assertDatabaseHas('shipments', [
            'id' => $shipmentId,
        ]);
    }}