<?php
return [
    // Group-specific rule: change in .env (CARGOTRACE_DELAY_THRESHOLD=12/18/24)
    'delay_threshold_hours' => (float) env('CARGOTRACE_DELAY_THRESHOLD', 12),
    'severity' => ['low_max' => 6, 'medium_max' => 24],
    'flow' => ['CREATED', 'BOOKED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'],
    'exception_types' => ['CUSTOMS_HOLD', 'WEATHER_DELAY', 'PORT_CONGESTION', 'DAMAGED', 'MISROUTED', 'DOCUMENTATION_ISSUE'],

    // Tarif estimasi demo dalam Rupiah per kilogram
    'shipping_rates' => [
        'sea freight' => 15000,
        'road freight' => 10000,
        'air freight' => 45000,
    ],
    'minimum_shipping_cost' => 25000,
];
