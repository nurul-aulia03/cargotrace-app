<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use App\Services\ShipmentService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TrackingController extends Controller
{
    public function index(Request $r, Shipment $shipment)
    {
        abort_unless($r->user()->isStaff() || (int) $shipment->customer_id === (int) $r->user()->id, 403, 'You are not allowed to access this shipment.');
        $events = $shipment->events()->with('location')->get();
        return ['shipment_number' => $shipment->shipment_number, 'status' => $shipment->status,
            'current_location' => $events->whereNotNull('latitude')->last()?->only(['latitude', 'longitude', 'occurred_at']), 'events' => $events];
    }

    public function store(Request $r, Shipment $shipment, ShipmentService $svc)
    {
        abort_unless($r->user()->isStaff(), 403, 'Operator or administrator role required.');
        $d = $r->validate([
            'event_type' => ['required', Rule::in(array_merge(config('cargotrace.flow'), ['NOTE']))],
            'occurred_at' => 'nullable|date|before_or_equal:now', 'location_id' => 'nullable|exists:locations,id',
            'latitude' => 'nullable|numeric|between:-90,90', 'longitude' => 'nullable|numeric|between:-180,180', 'description' => 'nullable|string|max:255',
        ]);
        return response()->json($svc->addEvent($shipment, $r->user(), $d), 201);
    }
}
