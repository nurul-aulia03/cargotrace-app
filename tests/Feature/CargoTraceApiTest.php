<?php
namespace Tests\Feature;

use App\Models\Carrier;
use App\Models\Location;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CargoTraceApiTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role): User
    {
        $u = User::factory()->create();
        $u->forceFill(['role' => $role])->save();
        return $u;
    }

    private function shipment(User $customer, array $over = []): Shipment
    {
        $carrier = Carrier::firstOrCreate(['name' => 'FastShip']);
        $a = Location::firstOrCreate(['name' => 'Singapore'], ['latitude' => 1.29, 'longitude' => 103.85]);
        $b = Location::firstOrCreate(['name' => 'Rotterdam'], ['latitude' => 51.92, 'longitude' => 4.48]);
        $exp = now()->addDays(3);
        $s = Shipment::create($over + [
            'shipment_number' => 'SHP-T-' . uniqid(), 'customer_id' => $customer->id, 'carrier_id' => $carrier->id,
            'origin_id' => $a->id, 'destination_id' => $b->id, 'cargo_type' => 'Electronics', 'weight_kg' => 500,
            'expected_departure_at' => now(), 'expected_arrival_at' => $exp, 'estimated_arrival_at' => $exp,
        ]);
        $s->status = 'CREATED'; $s->save();
        return $s;
    }

    public function test_login_valid_and_invalid(): void
    {
        $u = User::factory()->create(['password' => 'secret-pass-1']);
        $this->postJson('/api/login', ['email' => $u->email, 'password' => 'wrong'])->assertStatus(401);
        $this->postJson('/api/login', ['email' => $u->email, 'password' => 'secret-pass-1'])->assertOk()->assertJsonStructure(['token']);
    }

    public function test_requires_authentication(): void
    {
        $this->getJson('/api/shipments')->assertStatus(401);
    }

    public function test_customer_only_sees_own_shipments(): void
    {
        $me = $this->user('customer'); $other = $this->user('customer');
        $mine = $this->shipment($me); $theirs = $this->shipment($other);
        Sanctum::actingAs($me);
        $this->getJson('/api/shipments')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("/api/shipments/{$mine->id}")->assertOk();
        $this->getJson("/api/shipments/{$theirs->id}")->assertStatus(403);
        $this->getJson("/api/shipments/{$theirs->id}/tracking")->assertStatus(403);
    }

    public function test_customer_cannot_create_or_add_events(): void
    {
        $c = $this->user('customer'); $s = $this->shipment($c);
        Sanctum::actingAs($c);
        $this->postJson("/api/shipments/{$s->id}/tracking", ['event_type' => 'BOOKED'])->assertStatus(403);
        $this->postJson('/api/shipments', [])->assertStatus(403);
    }

    public function test_invalid_status_transition_is_rejected(): void
    {
        $s = $this->shipment($this->user('customer'));
        Sanctum::actingAs($this->user('operator'));
        $this->postJson("/api/shipments/{$s->id}/tracking", ['event_type' => 'DELIVERED'])->assertStatus(422)->assertJsonValidationErrors('event_type');
        $this->assertSame('CREATED', $s->fresh()->status);
    }

    public function test_valid_transition_updates_status_and_keeps_history(): void
    {
        $s = $this->shipment($this->user('customer'));
        Sanctum::actingAs($this->user('operator'));
        $this->postJson("/api/shipments/{$s->id}/tracking", ['event_type' => 'BOOKED'])->assertStatus(201);
        $this->assertSame('BOOKED', $s->fresh()->status);
        $this->postJson("/api/shipments/{$s->id}/tracking", ['event_type' => 'NOTE', 'description' => 'Docs checked'])->assertStatus(201);
        $this->assertCount(2, $s->events()->get());
    }

    public function test_delay_rule_and_severity(): void
    {
        config(['cargotrace.delay_threshold_hours' => 12]);
        $s = $this->shipment($this->user('customer'));
        $s->estimated_arrival_at = $s->expected_arrival_at->copy()->addHours(8);  // below threshold
        $this->assertFalse($s->delay['delayed']);
        $s->estimated_arrival_at = $s->expected_arrival_at->copy()->addHours(20); // MEDIUM
        $this->assertTrue($s->delay['delayed']);
        $this->assertSame('MEDIUM', $s->delay['severity']);
        $s->estimated_arrival_at = $s->expected_arrival_at->copy()->addHours(30); // HIGH
        $this->assertSame('HIGH', $s->delay['severity']);
    }

    public function test_shipment_validation_returns_422(): void
    {
        Sanctum::actingAs($this->user('operator'));
        $this->postJson('/api/shipments', ['cargo_type' => 'x'])->assertStatus(422);
    }
}
