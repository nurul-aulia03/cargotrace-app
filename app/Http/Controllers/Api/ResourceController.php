<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Carrier;
use App\Models\Location;
use App\Models\Shipment;
use App\Models\ShipmentException;
use App\Models\User;
use Illuminate\Http\Request;

class ResourceController extends Controller
{
    public function carriers() { return Carrier::orderBy('name')->get(); }
    public function locations() { return Location::orderBy('name')->get(); }

    public function storeCarrier(Request $r)
    {
        abort_unless($r->user()->isAdmin(), 403, 'Administrator role required.');
        return response()->json(Carrier::create($r->validate(['name' => 'required|string|max:100|unique:carriers,name', 'mode' => 'nullable|string|max:60', 'contact' => 'nullable|string|max:120'])), 201);
    }

    public function storeLocation(Request $r)
    {
        abort_unless($r->user()->isAdmin(), 403, 'Administrator role required.');
        return response()->json(Location::create($r->validate(['name' => 'required|string|max:120|unique:locations,name', 'country' => 'nullable|string|max:60', 'latitude' => 'required|numeric|between:-90,90', 'longitude' => 'required|numeric|between:-180,180'])), 201);
    }



    public function updateLocation(Request $r, Location $location)
    {
        abort_unless($r->user()->isAdmin(), 403, 'Administrator role required.');

        $data = $r->validate([
            'name' => 'required|string|max:120|unique:locations,name,' . $location->id,
            'country' => 'nullable|string|max:60',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
        ]);

        $location->update($data);

        return response()->json($location);
    }

    public function destroyLocation(Request $r, Location $location)
    {
        abort_unless($r->user()->isAdmin(), 403, 'Administrator role required.');

        $used = Shipment::where('origin_id', $location->id)
            ->orWhere('destination_id', $location->id)
            ->exists();

        if ($used) {
            return response()->json([
                'message' => 'Lokasi tidak dapat dihapus karena masih digunakan oleh data pengiriman.'
            ], 422);
        }

        $location->delete();

        return response()->json([
            'message' => 'Lokasi berhasil dihapus.'
        ]);
    }
    public function exceptions(Request $r)
    {
        $query = ShipmentException::with(['shipment.customer', 'shipment.carrier'])
            ->whereHas('shipment', fn ($q) => $q->visibleTo($r->user()));

        if ($r->filled('q')) {
            $search = trim($r->query('q'));

            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhereHas('shipment', fn ($shipment) =>
                        $shipment->where('shipment_number', 'like', "%{$search}%")
                    );
            });
        }

        foreach (['type', 'severity', 'status'] as $field) {
            if (!$r->filled($field)) {
                continue;
            }

            if ($field === 'status' && $r->query('status') === 'ACTIVE') {
                $query->whereIn('status', ['OPEN', 'INVESTIGATING']);
                continue;
            }

            $query->where($field, $r->query($field));
        }

        return $query
            ->latest('detected_at')
            ->paginate(15)
            ->appends($r->query());
    }
    public function users(Request $r)
    {
        abort_unless($r->user()->isAdmin(), 403, 'Administrator role required.');

        return User::select('id', 'name', 'email', 'role')
            ->orderBy('name')
            ->get();
    }
    public function dashboard(Request $r)
    {
        $u = $r->user();
        $base = fn () => Shipment::visibleTo($u);
        $ids = $base()->pluck('id');
        $delayed = $base()->where('status', '!=', 'DELIVERED')->get()->filter(fn ($s) => $s->delay['delayed'])->count(); // uses the configurable threshold
        $total = $base()->count();
        return [
            'total' => $total, 'in_transit' => $base()->where('status', 'IN_TRANSIT')->count(), 'delivered' => $base()->where('status', 'DELIVERED')->count(),
            'delayed' => $delayed, 'delay_rate_percent' => $total ? round($delayed / $total * 100, 1) : 0,
            'open_exceptions' => ShipmentException::whereIn('shipment_id', $ids)->where('status', '!=', 'RESOLVED')->count(),
            'by_status' => $base()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status'),
            'by_carrier' => $base()->join('carriers', 'carriers.id', '=', 'shipments.carrier_id')->selectRaw('carriers.name as name, count(*) as total')->groupBy('carriers.name')->pluck('total', 'name'),
        ];
    }

    public function audit(Request $r)
    {
        abort_unless($r->user()->isAdmin(), 403, 'Administrator role required.');
        return AuditLog::with('user:id,name,email')->latest()->paginate(25);
    }
}



