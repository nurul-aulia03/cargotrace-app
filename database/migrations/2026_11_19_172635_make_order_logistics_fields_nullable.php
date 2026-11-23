<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('origin_id')->nullable()->change();
            $table->foreignId('destination_id')->nullable()->change();
            $table->foreignId('carrier_id')->nullable()->change();

            $table->decimal('shipping_cost', 14, 2)->nullable()->change();
            $table->decimal('total_amount', 14, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('origin_id')->nullable(false)->change();
            $table->foreignId('destination_id')->nullable(false)->change();
            $table->foreignId('carrier_id')->nullable(false)->change();

            $table->decimal('shipping_cost', 14, 2)->nullable(false)->change();
            $table->decimal('total_amount', 14, 2)->nullable(false)->change();
        });
    }
};