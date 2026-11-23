<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class ShipmentException extends Model
{
    protected $table = 'shipment_exceptions';
    protected $fillable = ['shipment_id', 'type', 'severity', 'status', 'description', 'detected_at', 'resolved_at'];
    protected $casts = ['detected_at' => 'datetime', 'resolved_at' => 'datetime'];
    public function shipment() { return $this->belongsTo(Shipment::class); }
}
