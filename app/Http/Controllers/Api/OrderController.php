<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\Shipment;
use App\Models\Carrier;
use App\Models\Location;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    private function staff(Request $request): void
    {
        abort_unless(
            $request->user()->isStaff(),
            403,
            'Akses hanya untuk Operator atau Administrator.'
        );
    }

    private function visibleOrder(Request $request, Order $order): void
    {
        abort_unless(
            $request->user()->isStaff()
                || (int) $order->customer_id === (int) $request->user()->id,
            403,
            'Anda tidak memiliki akses ke pesanan ini.'
        );
    }

    private function relations(): array
    {
        return [
            'customer:id,name,email',
            'origin',
            'destination',
            'carrier',
            'shipment',
        ];
    }

    /**
     * Daftar pesanan.
     */
    public function index(Request $request)
    {
        $request->validate([
            'status' => 'nullable|string|max:30',
            'per_page' => 'nullable|integer|min:1|max:50',
        ]);

        $query = Order::with($this->relations());

        if (!$request->user()->isStaff()) {
            $query->where('customer_id', $request->user()->id);
        }

        if ($request->filled('status')) {
            $query->where('order_status', $request->query('status'));
        }

        return $query->latest()->paginate(
            (int) $request->query('per_page', 10)
        );
    }

    /**
     * Customer membuat pesanan.
     * Customer tidak menentukan ekspedisi dan lokasi operasional.
     */
    public function store(Request $request)
    {
        abort_unless(
            $request->user()->role === 'customer',
            403,
            'Fitur pembuatan pesanan hanya untuk Customer.'
        );

        $data = $request->validate([
            'item_name' => 'required|string|max:150',
            'item_description' => 'nullable|string|max:2000',
            'quantity' => 'required|integer|min:1|max:100000',
            'weight_kg' => 'required|numeric|min:0.01|max:100000',

            'sender_name' => 'required|string|max:150',
            'sender_phone' => 'required|string|max:30',
            'sender_address' => 'required|string|max:2000',

            'recipient_name' => 'required|string|max:150',
            'recipient_phone' => 'required|string|max:30',
            'recipient_address' => 'required|string|max:2000',

            'item_value' => 'nullable|numeric|min:0|max:999999999999',
            'payment_method' => 'nullable|in:TRANSFER,CASH,COD',
            'notes' => 'nullable|string|max:2000',
        ]);

        $itemValue = (float) ($data['item_value'] ?? 0);

        $order = Order::create([
            'order_number' => 'ORD-' . now()->format('Ymd') . '-' . strtoupper(Str::random(6)),
            'customer_id' => $request->user()->id,

            'item_name' => $data['item_name'],
            'item_description' => $data['item_description'] ?? null,
            'quantity' => $data['quantity'],
            'weight_kg' => $data['weight_kg'],

            'sender_name' => $data['sender_name'],
            'sender_phone' => $data['sender_phone'],
            'sender_address' => $data['sender_address'],
            'origin_id' => null,

            'recipient_name' => $data['recipient_name'],
            'recipient_phone' => $data['recipient_phone'],
            'recipient_address' => $data['recipient_address'],
            'destination_id' => null,

            'carrier_id' => null,
            'item_value' => $itemValue,
            'shipping_cost' => null,
            'total_amount' => null,

            'payment_method' => $data['payment_method'] ?? null,
            'payment_status' => 'UNPAID',
            'order_status' => 'PENDING',
            'notes' => $data['notes'] ?? null,
        ]);

        AuditLog::record(
            $request->user()->id,
            'order:create',
            'order',
            $order->id
        );

        return response()->json([
            'message' => 'Pesanan berhasil dibuat dan menunggu penugasan Operator.',
            'data' => $order->load($this->relations()),
        ], 201);
    }

    /**
     * Detail pesanan.
     */
    public function show(Request $request, Order $order)
    {
        $this->visibleOrder($request, $order);

        return $order->load([
            ...$this->relations(),
            'shipment.items',
            'shipment.events.location',
        ]);
    }

    /**
     * Operator/Admin menentukan ekspedisi dan lokasi,
     * kemudian menyetujui pesanan dan membuat shipment.
     */
    public function approve(Request $request, Order $order)
    {
        $this->staff($request);

        $data = $request->validate([
            'carrier_id' => 'required|exists:carriers,id',
            'origin_id' => 'required|exists:locations,id',
            'destination_id' => 'required|different:origin_id|exists:locations,id',
        ]);

        $shipment = DB::transaction(function () use ($request, $order, $data) {
            $lockedOrder = Order::whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedOrder->order_status !== 'PENDING') {
                throw ValidationException::withMessages([
                    'order_status' => [
                        'Hanya pesanan PENDING yang dapat disetujui.'
                    ],
                ]);
            }

            if ($lockedOrder->shipment_id !== null) {
                throw ValidationException::withMessages([
                    'shipment_id' => [
                        'Pesanan ini sudah memiliki pengiriman.'
                    ],
                ]);
            }

            $carrier = Carrier::findOrFail($data['carrier_id']);
            $origin = Location::findOrFail($data['origin_id']);
            $destination = Location::findOrFail($data['destination_id']);

            $mode = strtolower(trim((string) $carrier->mode));

            $rates = config('cargotrace.shipping_rates', []);
            $rate = $rates[$mode] ?? null;

            if ($rate === null) {
                throw ValidationException::withMessages([
                    'carrier_id' => [
                        'Tarif untuk jenis layanan kurir ini belum tersedia.'
                    ],
                ]);
            }

            $shippingCost = max(
                (float) config('cargotrace.minimum_shipping_cost', 25000),
                (float) $lockedOrder->weight_kg * (float) $rate
            );

            $itemValue = (float) ($lockedOrder->item_value ?? 0);
            $totalAmount = $itemValue + $shippingCost;

            $departure = now();

            $arrival = $departure->copy()->addDays(
                match ($mode) {
                    'air freight' => 3,
                    'road freight' => 5,
                    default => 14,
                }
            );

            // Simpan pilihan operasional dan biaya ke pesanan.
            $lockedOrder->update([
                'carrier_id' => $carrier->id,
                'origin_id' => $origin->id,
                'destination_id' => $destination->id,
                'shipping_cost' => $shippingCost,
                'total_amount' => $totalAmount,
            ]);

            // Buat shipment berdasarkan pesanan yang disetujui.
            $shipment = Shipment::create([
                'shipment_number' => 'SHP-' . now()->format('Y') . '-' . strtoupper(Str::random(6)),
                'customer_id' => $lockedOrder->customer_id,
                'carrier_id' => $carrier->id,
                'origin_id' => $origin->id,
                'destination_id' => $destination->id,
                'cargo_type' => $lockedOrder->item_name,
                'weight_kg' => $lockedOrder->weight_kg,
                'expected_departure_at' => $departure,
                'expected_arrival_at' => $arrival,
                'estimated_arrival_at' => $arrival,
            ]);

            $shipment->items()->create([
                'description' => $lockedOrder->item_name,
                'quantity' => $lockedOrder->quantity,
            ]);

            $shipment->events()->create([
                'event_type' => 'CREATED',
                'occurred_at' => $departure,
                'location_id' => $origin->id,
                'latitude' => $origin->latitude,
                'longitude' => $origin->longitude,
                'description' => 'Shipment created from approved customer order ' . $lockedOrder->order_number,
                'created_by' => $request->user()->id,
            ]);

            $lockedOrder->update([
                'order_status' => 'APPROVED',
                'shipment_id' => $shipment->id,
            ]);

            AuditLog::record(
                $request->user()->id,
                'order:approve',
                'order',
                $lockedOrder->id
            );

            AuditLog::record(
                $request->user()->id,
                'shipment:create_from_order',
                'shipment',
                $shipment->id
            );

            return $shipment;
        });

        return response()->json([
            'message' => 'Pesanan disetujui dan pengiriman berhasil dibuat.',
            'data' => $order->fresh()->load($this->relations()),
            'shipment' => $shipment->load([
                'carrier',
                'origin',
                'destination',
                'items',
                'events',
            ]),
        ]);
    }

    /**
     * Operator/Admin menolak pesanan.
     */
    public function reject(Request $request, Order $order)
    {
        $this->staff($request);

        $data = $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        DB::transaction(function () use ($request, $order, $data) {
            $lockedOrder = Order::whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedOrder->order_status !== 'PENDING') {
                throw ValidationException::withMessages([
                    'order_status' => [
                        'Hanya pesanan PENDING yang dapat ditolak.'
                    ],
                ]);
            }

            $lockedOrder->update([
                'order_status' => 'REJECTED',
                'notes' => trim(
                    ($lockedOrder->notes ? $lockedOrder->notes . "\n" : '')
                    . 'Alasan penolakan: '
                    . $data['reason']
                ),
            ]);

            AuditLog::record(
                $request->user()->id,
                'order:reject',
                'order',
                $lockedOrder->id
            );
        });

        return response()->json([
            'message' => 'Pesanan berhasil ditolak.',
            'data' => $order->fresh()->load($this->relations()),
        ]);
    }

    /**
     * Customer membatalkan pesanan yang masih PENDING.
     */
    public function cancel(Request $request, Order $order)
    {
        abort_unless(
            $request->user()->role === 'customer',
            403,
            'Hanya Customer yang dapat membatalkan pesanan sendiri.'
        );

        $this->visibleOrder($request, $order);

        DB::transaction(function () use ($request, $order) {
            $lockedOrder = Order::whereKey($order->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedOrder->order_status !== 'PENDING') {
                throw ValidationException::withMessages([
                    'order_status' => [
                        'Pesanan hanya dapat dibatalkan saat masih PENDING.'
                    ],
                ]);
            }

            $lockedOrder->update([
                'order_status' => 'CANCELLED',
            ]);

            AuditLog::record(
                $request->user()->id,
                'order:cancel',
                'order',
                $lockedOrder->id
            );
        });

        return response()->json([
            'message' => 'Pesanan berhasil dibatalkan.',
            'data' => $order->fresh()->load($this->relations()),
        ]);
    }
}