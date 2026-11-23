<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $t) => $t->string('role', 20)->default('customer')->index());
        Schema::create('carriers', function (Blueprint $t) {
            $t->id(); $t->string('name')->unique(); $t->string('mode')->nullable(); $t->string('contact')->nullable(); $t->timestamps();
        });
        Schema::create('locations', function (Blueprint $t) {
            $t->id(); $t->string('name')->unique(); $t->string('country', 60)->nullable();
            $t->decimal('latitude', 9, 6); $t->decimal('longitude', 9, 6); $t->timestamps();
        });
        Schema::create('shipments', function (Blueprint $t) {
            $t->id(); $t->string('shipment_number')->unique();
            $t->foreignId('customer_id')->constrained('users');
            $t->foreignId('carrier_id')->constrained();
            $t->foreignId('origin_id')->constrained('locations');
            $t->foreignId('destination_id')->constrained('locations');
            $t->string('cargo_type'); $t->decimal('weight_kg', 10, 2); $t->decimal('volume_m3', 10, 2)->nullable();
            $t->dateTime('expected_departure_at'); $t->dateTime('expected_arrival_at'); $t->dateTime('estimated_arrival_at');
            $t->string('status', 20)->default('CREATED')->index(); $t->timestamps();
            $t->index(['customer_id', 'status']);
        });
        Schema::create('shipment_items', function (Blueprint $t) {
            $t->id(); $t->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $t->string('description'); $t->unsignedInteger('quantity')->default(1); $t->timestamps();
        });
        Schema::create('tracking_events', function (Blueprint $t) {
            $t->id(); $t->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $t->string('event_type', 20); $t->dateTime('occurred_at');
            $t->foreignId('location_id')->nullable()->constrained();
            $t->decimal('latitude', 9, 6)->nullable(); $t->decimal('longitude', 9, 6)->nullable();
            $t->string('description')->nullable(); $t->boolean('is_exception')->default(false);
            $t->foreignId('created_by')->nullable()->constrained('users'); $t->timestamps();
            $t->index(['shipment_id', 'occurred_at']);
        });
        Schema::create('shipment_exceptions', function (Blueprint $t) {
            $t->id(); $t->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $t->string('type', 30); $t->string('severity', 10); $t->string('status', 20)->default('OPEN')->index();
            $t->string('description')->nullable(); $t->dateTime('detected_at'); $t->dateTime('resolved_at')->nullable(); $t->timestamps();
        });
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id(); $t->foreignId('user_id')->nullable()->constrained(); $t->string('action');
            $t->string('entity_type', 40); $t->unsignedBigInteger('entity_id'); $t->timestamps();
            $t->index(['entity_type', 'entity_id']);
        });
    }

    public function down(): void
    {
        foreach (['audit_logs', 'shipment_exceptions', 'tracking_events', 'shipment_items', 'shipments', 'locations', 'carriers'] as $n) Schema::dropIfExists($n);
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('role'));
    }
};
