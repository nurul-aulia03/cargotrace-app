<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Location;
use App\Models\Shipment;
use App\Models\TrackingEvent;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ShipmentService
{
    public function nextStatus(string $current): ?string
    {
        $flow = config('cargotrace.flow');
        $i = array_search($current, $flow, true);

        return $i === false ? null : ($flow[$i + 1] ?? null);
    }

    /**
     * Menambahkan riwayat tracking dan notifikasi Customer.
     */
    public function addEvent(Shipment $s, User $u, array $d): TrackingEvent
    {
        return DB::transaction(function () use ($s, $u, $d) {
            $s = Shipment::whereKey($s->id)
                ->lockForUpdate()
                ->firstOrFail();

            $type = $d['event_type'];

            if (
                $type !== 'NOTE' &&
                $type !== $this->nextStatus($s->status)
            ) {
                $next = $this->nextStatus($s->status) ?? 'none (terminal status)';

                throw ValidationException::withMessages([
                    'event_type' => [
                        "Invalid transition {$s->status} -> {$type}. Next allowed: {$next}."
                    ]
                ]);
            }

            $when = isset($d['occurred_at'])
                ? \Carbon\Carbon::parse($d['occurred_at'])
                : now();

            $last = $s->events()->latest('occurred_at')->first();

            if ($last && $when->lt($last->occurred_at)) {
                throw ValidationException::withMessages([
                    'occurred_at' => [
                        'Event time cannot be earlier than the last event.'
                    ]
                ]);
            }

            $loc = isset($d['location_id'])
                ? Location::find($d['location_id'])
                : null;

            $event = $s->events()->create([
                'event_type' => $type,
                'occurred_at' => $when,
                'location_id' => $loc?->id,
                'latitude' => $d['latitude'] ?? $loc?->latitude,
                'longitude' => $d['longitude'] ?? $loc?->longitude,
                'description' => $d['description'] ??
                    ($type === 'NOTE' ? 'Note' : "Status changed to {$type}"),
                'is_exception' => false,
                'created_by' => $u->id,
            ]);

            if ($type !== 'NOTE') {
                $s->status = $type;
                $s->save();

                // Kirim notifikasi kepada Customer pemilik pengiriman.
                $customer = User::find($s->customer_id);

                if ($customer) {
                    $customer->notifications()->create([
                        'id' => (string) Str::uuid(),
                        'type' => 'shipment_status_changed',
                        'data' => [
                            'title' => 'Pembaruan Status Pengiriman',
                            'message' => "Pengiriman {$s->shipment_number} sekarang berstatus {$type}.",
                            'shipment_id' => $s->id,
                            'shipment_number' => $s->shipment_number,
                            'event_type' => $type,
                            'description' => $event->description,
                            'occurred_at' => $when->toDateTimeString(),
                            'url' => '/app/index.html',
                        ],
                    ]);
                }
            }

            AuditLog::record(
                $u->id,
                "tracking_event:{$type}",
                'shipment',
                $s->id
            );

            return $event;
        });
    }
}