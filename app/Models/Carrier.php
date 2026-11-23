<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class Carrier extends Model
{
    protected $fillable = ['name', 'mode', 'contact'];
    public function shipments() { return $this->hasMany(Shipment::class); }
}
