<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = [
        'order_number',
        'customer_id',
        'item_name',
        'item_description',
        'quantity',
        'weight_kg',
        'sender_name',
        'sender_phone',
        'sender_address',
        'origin_id',
        'recipient_name',
        'recipient_phone',
        'recipient_address',
        'destination_id',
        'carrier_id',
        'item_value',
        'shipping_cost',
        'total_amount',
        'payment_method',
        'payment_status',
        'order_status',
        'shipment_id',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'weight_kg' => 'decimal:2',
        'item_value' => 'decimal:2',
        'shipping_cost' => 'decimal:2',
        'total_amount' => 'decimal:2',
    ];

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function origin()
    {
        return $this->belongsTo(Location::class, 'origin_id');
    }

    public function destination()
    {
        return $this->belongsTo(Location::class, 'destination_id');
    }

    public function carrier()
    {
        return $this->belongsTo(Carrier::class);
    }

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }
}
