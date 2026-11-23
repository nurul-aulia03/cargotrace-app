<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Shipment;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ShipmentController extends Controller
{
    private function mine(Request $r, Shipment $s): void
    {
        abort_unless($r->user()->isStaff() || (int) $s->customer_id === (int) $r->user()->id, 403, 'You are not allowed to access this shipment.');
    }

    private function staff(Request $r): void { abort_unless($r->user()->isStaff(), 403, 'Operator or administrator role required.'); }

    private function rules(bool $create): array
    {
        $req = $create ? 'required' : 'sometimes';
        return [
            'customer_id' => "$req|exists:users,id", 'carrier_id' => "$req|exists:carriers,id",
            'origin_id' => "$req|exists:locations,id", 'destination_id' => "$req|different:origin_id|exists:locations,id",
            'cargo_type' => "$req|string|max:60", 'weight_kg' => "$req|numeric|min:0.01", 'volume_m3' => 'nullable|numeric|min:0',
            'expected_departure_at' => "$req|date", 'expected_arrival_at' => "$req|date|after:expected_departure_at",
            'estimated_arrival_at' => 'sometimes|date',
        ];
    }

    public function index(Request $r)
    {
        $r->validate(['per_page' => 'integer|min:1|max:50', 'sort' => 'in:shipment_number,expected_arrival_at,estimated_arrival_at,created_at', 'dir' => 'in:asc,desc']);
        $q = Shipment::visibleTo($r->user())->with(['carrier', 'origin', 'destination', 'customer:id,name']);
        if ($s = $r->query('q')) $q->where('shipment_number', 'like', '%' . $s . '%');
        foreach (['status', 'carrier_id', 'origin_id', 'destination_id'] as $f) if ($r->filled($f)) $q->where($f, $r->query($f));
        if ($r->filled('from')) $q->whereDate('expected_arrival_at', '>=', $r->query('from'));
        if ($r->filled('to')) $q->whereDate('expected_arrival_at', '<=', $r->query('to'));
        if ($r->boolean('delayed')) {
            $threshold = (float) config('cargotrace.delay_threshold_hours');
            $q->where('status', '!=', 'DELIVERED');

            $driver = $q->getConnection()->getDriverName();

            if ($driver === 'sqlite') {
                $q->whereRaw(
                    '(julianday(estimated_arrival_at) - julianday(expected_arrival_at)) * 24 > ?',
                    [$threshold]
                );
            } else {
                $q->whereRaw(
                    'TIMESTAMPDIFF(MICROSECOND, expected_arrival_at, estimated_arrival_at) > ?',
                    [$threshold * 3600000000]
                );
            }
        }
        return $q->orderBy($r->query('sort', 'created_at'), $r->query('dir', 'desc'))->paginate((int) $r->query('per_page', 10));
    }

    public function store(Request $r)
    {
        $this->staff($r);
        $d = $r->validate($this->rules(true));
        $d['estimated_arrival_at'] ??= $d['expected_arrival_at'];
        $s = Shipment::create($d + ['shipment_number' => 'SHP-' . now()->format('Y') . '-' . strtoupper(Str::random(6))]);
        $s->events()->create(['event_type' => 'CREATED', 'occurred_at' => now(), 'location_id' => $s->origin_id,
            'latitude' => $s->origin->latitude, 'longitude' => $s->origin->longitude, 'description' => 'Shipment created', 'created_by' => $r->user()->id]);
        AuditLog::record($r->user()->id, 'shipment:create', 'shipment', $s->id);
        return response()->json($s->fresh()->load(['carrier', 'origin', 'destination']), 201);
    }

    public function show(Request $r, Shipment $shipment)
    {
        $this->mine($r, $shipment);
        return $shipment->load(['carrier', 'origin', 'destination', 'items', 'events', 'exceptions']);
    }

    public function update(Request $r, Shipment $shipment)
    {
        $this->staff($r);
        $shipment->update($r->validate($this->rules(false))); // status cannot be changed here
        AuditLog::record($r->user()->id, 'shipment:update', 'shipment', $shipment->id);
        return $shipment->fresh();
    }

    public function destroy(Request $r, Shipment $shipment)
    {
        abort_unless($r->user()->isAdmin(), 403, 'Administrator role required.');
        AuditLog::record($r->user()->id, 'shipment:delete', 'shipment', $shipment->id);
        $shipment->delete();
        return response()->json(null, 204);
    }
}
