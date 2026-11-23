<?php
namespace Database\Seeders;

use App\Models\Carrier;
use App\Models\Location;
use App\Models\Shipment;
use App\Models\ShipmentException;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $mk = function (string $name, string $email, string $role) {
            $u = new User(['name' => $name, 'email' => $email, 'password' => 'password']);
            $u->role = $role; $u->save(); return $u;
        };
        $mk('Admin', 'admin@cargotrace.test', 'admin');
        $mk('Operator', 'operator@cargotrace.test', 'operator');
        $customers = [$mk('Global Industries', 'customer@cargotrace.test', 'customer'), $mk('Tech Solutions', 'tech@cargotrace.test', 'customer')];

        foreach ([['FastShip', 'Sea freight'], ['CargoPro', 'Road freight'], ['Logistics Partners', 'Air freight']] as [$n, $m]) {
            Carrier::create(['name' => $n, 'mode' => $m, 'contact' => strtolower(str_replace(' ', '', $n)) . '@example.com']);
        }
        $locs = [['Singapore', 'SG', 1.29, 103.85], ['Rotterdam', 'NL', 51.92, 4.48], ['Los Angeles', 'US', 34.05, -118.24], ['Jakarta', 'ID', -6.21, 106.85], ['Sydney', 'AU', -33.87, 151.21], ['Hamburg', 'DE', 53.55, 9.99]];
        foreach ($locs as [$n, $c, $la, $lo]) Location::create(['name' => $n, 'country' => $c, 'latitude' => $la, 'longitude' => $lo]);

        mt_srand(42);
        $flow = config('cargotrace.flow');
        for ($i = 0; $i < 20; $i++) {
            $o = mt_rand(1, 6); do { $d = mt_rand(1, 6); } while ($d === $o);
            $si = mt_rand(0, 4);
            $exp = now()->addHours($si === 4 ? -mt_rand(24, 200) : mt_rand(-24, 150));
            $late = mt_rand(0, 100) < 35 ? mt_rand(1, 40) : -mt_rand(0, 5);
            $s = Shipment::create([
                'shipment_number' => 'SHP-2026-' . str_pad((string) (1100 + $i), 5, '0', STR_PAD_LEFT),
                'customer_id' => $customers[$i % 2]->id, 'carrier_id' => mt_rand(1, 3), 'origin_id' => $o, 'destination_id' => $d,
                'cargo_type' => ['Electronics', 'Machinery', 'Apparel'][$i % 3], 'weight_kg' => mt_rand(200, 9000),
                'expected_departure_at' => $exp->copy()->subHours(96), 'expected_arrival_at' => $exp, 'estimated_arrival_at' => $exp->copy()->addHours($late),
            ]);
            $s->status = $flow[$si]; $s->save();
            for ($k = 0; $k <= $si; $k++) {
                $loc = Location::find($k === 4 ? $d : $o);
                $s->events()->create(['event_type' => $flow[$k], 'occurred_at' => now()->subHours(96 - $k * 20), 'location_id' => $loc->id,
                    'latitude' => $loc->latitude, 'longitude' => $loc->longitude, 'description' => 'Status changed to ' . $flow[$k]]);
            }
            if ($si >= 2 && $si < 4 && $late > 6) {
                ShipmentException::create(['shipment_id' => $s->id, 'type' => config('cargotrace.exception_types')[$i % 6], 'severity' => $late > 24 ? 'HIGH' : 'MEDIUM', 'status' => 'OPEN', 'detected_at' => now()->subHours(5)]);
            }
        }
    }
}
