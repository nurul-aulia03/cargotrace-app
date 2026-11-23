<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class TrackingEvent extends Model
{
    protected $fillable = ['shipment_id', 'event_type', 'occurred_at', 'location_id', 'latitude', 'longitude', 'description', 'is_exception', 'created_by'];
    protected $casts = ['occurred_at' => 'datetime', 'is_exception' => 'boolean', 'latitude' => 'float', 'longitude' => 'float'];
    public function shipment() { return $this->belongsTo(Shipment::class); }
    public function location() { return $this->belongsTo(Location::class); }
}
