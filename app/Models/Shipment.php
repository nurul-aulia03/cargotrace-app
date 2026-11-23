<?php
namespace App\Models;

use App\Services\EtaService;
use Illuminate\Database\Eloquent\Model;

class Shipment extends Model
{
    protected $fillable = ['shipment_number', 'customer_id', 'carrier_id', 'origin_id', 'destination_id', 'cargo_type',
        'weight_kg', 'volume_m3', 'expected_departure_at', 'expected_arrival_at', 'estimated_arrival_at'];
    // 'status' is NOT fillable: it only changes through ShipmentService (business rules).
    protected $casts = ['expected_departure_at' => 'datetime', 'expected_arrival_at' => 'datetime', 'estimated_arrival_at' => 'datetime'];
    protected $appends = ['delay'];

    public function getDelayAttribute(): array { return app(EtaService::class)->evaluate($this); }
    public function scopeVisibleTo($q, User $u) { return $u->isStaff() ? $q : $q->where('customer_id', $u->id); }
    public function customer() { return $this->belongsTo(User::class, 'customer_id'); }
    public function carrier() { return $this->belongsTo(Carrier::class); }
    public function origin() { return $this->belongsTo(Location::class, 'origin_id'); }
    public function destination() { return $this->belongsTo(Location::class, 'destination_id'); }
    public function events() { return $this->hasMany(TrackingEvent::class)->orderBy('occurred_at'); }
    public function exceptions() { return $this->hasMany(ShipmentException::class); }
    public function items() { return $this->hasMany(ShipmentItem::class); }
}
