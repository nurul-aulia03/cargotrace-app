<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->unique();
            $table->foreignId('customer_id')->constrained('users');

            $table->string('item_name', 150);
            $table->text('item_description')->nullable();
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('weight_kg', 10, 2);

            $table->string('sender_name');
            $table->string('sender_phone', 30);
            $table->text('sender_address');
            $table->foreignId('origin_id')->constrained('locations');

            $table->string('recipient_name');
            $table->string('recipient_phone', 30);
            $table->text('recipient_address');
            $table->foreignId('destination_id')->constrained('locations');

            $table->foreignId('carrier_id')->constrained('carriers');
            $table->decimal('item_value', 14, 2)->default(0);
            $table->decimal('shipping_cost', 14, 2);
            $table->decimal('total_amount', 14, 2);

            $table->string('payment_method', 40)->nullable();
            $table->string('payment_status', 20)->default('UNPAID');
            $table->string('order_status', 30)->default('PENDING');
            $table->foreignId('shipment_id')->nullable()->unique()->constrained('shipments')->nullOnDelete();

            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['customer_id', 'order_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
