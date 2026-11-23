<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class ShipmentItem extends Model
{
    protected $fillable = ['shipment_id', 'description', 'quantity'];
}
