<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Shipment;
use App\Models\ShipmentException;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ExceptionController extends Controller
{
    public function index(Request $r, Shipment $shipment)
    {
        abort_unless($r->user()->isStaff() || $shipment->customer_id === $r->user()->id, 403, 'You are not allowed to access this shipment.');
        return $shipment->exceptions()->latest('detected_at')->get();
    }

    public function store(Request $r, Shipment $shipment)
    {
        abort_unless($r->user()->isStaff(), 403, 'Operator or administrator role required.');
        $d = $r->validate(['type' => ['required', Rule::in(config('cargotrace.exception_types'))], 'severity' => 'required|in:LOW,MEDIUM,HIGH', 'description' => 'nullable|string|max:255']);
        $x = $shipment->exceptions()->create($d + ['status' => 'OPEN', 'detected_at' => now()]);
        $shipment->events()->create(['event_type' => 'EXCEPTION', 'occurred_at' => now(), 'description' => 'Exception: ' . $d['type'], 'is_exception' => true, 'created_by' => $r->user()->id]);
        AuditLog::record($r->user()->id, 'exception:create', 'shipment_exception', $x->id);
        return response()->json($x, 201);
    }

    public function update(Request $r, ShipmentException $exception)
    {
        abort_unless($r->user()->isStaff(), 403, 'Operator or administrator role required.');
        $d = $r->validate(['status' => 'required|in:INVESTIGATING,RESOLVED']);
        $ok = ['OPEN' => ['INVESTIGATING', 'RESOLVED'], 'INVESTIGATING' => ['RESOLVED']][$exception->status] ?? [];
        if (!in_array($d['status'], $ok, true)) {
            throw ValidationException::withMessages(['status' => ["Cannot change {$exception->status} -> {$d['status']}."]]);
        }
        $exception->update(['status' => $d['status'], 'resolved_at' => $d['status'] === 'RESOLVED' ? now() : null]);
        AuditLog::record($r->user()->id, 'exception:' . $d['status'], 'shipment_exception', $exception->id);
        return $exception;
    }

    public function history(Request $r, ShipmentException $exception)
    {
        abort_unless($r->user()->isStaff(), 403, 'Staff access required.');

        $exception->load([
            'shipment.customer',
            'shipment.carrier',
            'shipment.origin',
            'shipment.destination'
        ]);

        $history = AuditLog::with('user:id,name,email')
            ->where('entity_type', 'shipment_exception')
            ->where('entity_id', $exception->id)
            ->orderBy('created_at')
            ->get();

        return response()->json([
            'exception' => $exception,
            'history' => $history
        ]);
    }
}
