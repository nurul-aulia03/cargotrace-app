<?php
namespace App\Services;

use App\Models\Shipment;

class EtaService
{
    public function severity(float $hours): string
    {
        $c = config('cargotrace.severity');
        return $hours <= $c['low_max'] ? 'LOW' : ($hours <= $c['medium_max'] ? 'MEDIUM' : 'HIGH');
    }

    /** Delayed when estimated arrival is later than expected arrival by more than the threshold. */
    public function evaluate(Shipment $s): array
    {
        $t = (float) config('cargotrace.delay_threshold_hours');
        if (!$s->estimated_arrival_at || !$s->expected_arrival_at) {
            return ['delayed' => false, 'hours' => 0.0, 'severity' => null, 'threshold_hours' => $t, 'reason' => 'No ETA data'];
        }
        $h = ($s->estimated_arrival_at->getTimestamp() - $s->expected_arrival_at->getTimestamp()) / 3600;
        $delayed = $h > 0 && $h > $t;
        return [
            'delayed' => $delayed,
            'hours' => round(max($h, 0), 2),
            'severity' => $delayed ? $this->severity($h) : null,
            'threshold_hours' => $t,
            'reason' => $delayed ? "ETA is {$h}h after expected arrival (threshold {$t}h)" : 'Within threshold',
        ];
    }
}
