<?php

namespace Tests\Feature;

use App\Models\Carrier;
use App\Models\Location;
use App\Models\Shipment;
use App\Models\ShipmentException;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OperatorExceptionTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        $user = User::factory()->create();
        $user->forceFill(['role' => $role])->save();

        return $user;
    }

    private function shipment(User $customer): Shipment
    {
        $carrier = Carrier::firstOrCreate(['name' => 'FastShip']);
        $origin = Location::firstOrCreate(
            ['name' => 'Singapore'],
            ['latitude' => 1.29, 'longitude' => 103.85]
        );
        $destination = Location::firstOrCreate(
            ['name' => 'Rotterdam'],
            ['latitude' => 51.92, 'longitude' => 4.48]
        );

        return Shipment::create([
            'shipment_number' => 'SHP-EX-' . uniqid(),
            'customer_id' => $customer->id,
            'carrier_id' => $carrier->id,
            'origin_id' => $origin->id,
            'destination_id' => $destination->id,
            'cargo_type' => 'Electronics',
            'weight_kg' => 100,
            'expected_departure_at' => now(),
            'expected_arrival_at' => now()->addDays(5),
            'estimated_arrival_at' => now()->addDays(5),
            'status' => 'CREATED',
        ]);
    }

    public function test_operator_can_create_exception_and_tracking_event(): void
    {
        $shipment = $this->shipment($this->user('customer'));
        Sanctum::actingAs($this->user('operator'));

        $response = $this->postJson(
            "/api/shipments/{$shipment->id}/exceptions",
            [
                'type' => 'WEATHER_DELAY',
                'severity' => 'HIGH',
                'description' => 'Cuaca buruk menghambat perjalanan.',
            ]
        );

        $response->assertCreated()
            ->assertJsonPath('type', 'WEATHER_DELAY')
            ->assertJsonPath('severity', 'HIGH')
            ->assertJsonPath('status', 'OPEN');

        $this->assertDatabaseHas('shipment_exceptions', [
            'shipment_id' => $shipment->id,
            'type' => 'WEATHER_DELAY',
            'status' => 'OPEN',
        ]);

        $this->assertDatabaseHas('tracking_events', [
            'shipment_id' => $shipment->id,
            'event_type' => 'EXCEPTION',
            'is_exception' => true,
        ]);
    }

    public function test_customer_cannot_create_exception(): void
    {
        $customer = $this->user('customer');
        $shipment = $this->shipment($customer);

        Sanctum::actingAs($customer);

        $this->postJson(
            "/api/shipments/{$shipment->id}/exceptions",
            [
                'type' => 'DAMAGED',
                'severity' => 'HIGH',
            ]
        )->assertForbidden();
    }

    public function test_operator_can_investigate_and_resolve_exception(): void
    {
        $shipment = $this->shipment($this->user('customer'));
        $exception = $shipment->exceptions()->create([
            'type' => 'CUSTOMS_HOLD',
            'severity' => 'MEDIUM',
            'status' => 'OPEN',
            'detected_at' => now(),
        ]);

        Sanctum::actingAs($this->user('operator'));

        $this->patchJson("/api/exceptions/{$exception->id}", [
            'status' => 'INVESTIGATING',
        ])->assertOk()->assertJsonPath('status', 'INVESTIGATING');

        $this->patchJson("/api/exceptions/{$exception->id}", [
            'status' => 'RESOLVED',
        ])->assertOk()->assertJsonPath('status', 'RESOLVED');

        $this->assertNotNull($exception->fresh()->resolved_at);
    }

    public function test_invalid_exception_transition_is_rejected(): void
    {
        $shipment = $this->shipment($this->user('customer'));
        $exception = $shipment->exceptions()->create([
            'type' => 'DAMAGED',
            'severity' => 'HIGH',
            'status' => 'RESOLVED',
            'detected_at' => now(),
            'resolved_at' => now(),
        ]);

        Sanctum::actingAs($this->user('operator'));

        $this->patchJson("/api/exceptions/{$exception->id}", [
            'status' => 'INVESTIGATING',
        ])->assertUnprocessable();

        $this->assertSame('RESOLVED', $exception->fresh()->status);
    }

    public function test_invalid_exception_type_is_rejected(): void
    {
        $shipment = $this->shipment($this->user('customer'));
        Sanctum::actingAs($this->user('operator'));

        $this->postJson(
            "/api/shipments/{$shipment->id}/exceptions",
            [
                'type' => 'INVALID_TYPE',
                'severity' => 'HIGH',
            ]
        )->assertUnprocessable()->assertJsonValidationErrors('type');
    }
}
