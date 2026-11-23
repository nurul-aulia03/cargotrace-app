<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\ExceptionController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\ResourceController;
use App\Http\Controllers\Api\NewsController;
use App\Http\Controllers\Api\ShipmentController;
use App\Http\Controllers\Api\TrackingController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Http;

Route::post('register', [AuthController::class, 'register'])
    ->middleware('throttle:10,1');

Route::post('login', [AuthController::class, 'login'])
    ->middleware('throttle:10,1');

Route::middleware('auth:sanctum')->group(function () {

    // AUTHENTICATION
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('user', [AuthController::class, 'user']);
    Route::patch('profile', [ProfileController::class, 'update']);
    Route::post('profile/password', [ProfileController::class, 'password']);

    // DASHBOARD & MANAGEMENT
    Route::get('users', [ResourceController::class, 'users']);
    Route::get('dashboard', [ResourceController::class, 'dashboard']);
    Route::get('audit-logs', [ResourceController::class, 'audit']);
    Route::get('exceptions', [ResourceController::class, 'exceptions']);

    // CUSTOMER ORDERS
    Route::get('orders', [OrderController::class, 'index']);
    Route::post('orders', [OrderController::class, 'store']);
    Route::get('orders/{order}', [OrderController::class, 'show']);
    Route::post('orders/{order}/approve', [OrderController::class, 'approve']);
    Route::post('orders/{order}/reject', [OrderController::class, 'reject']);
    Route::post('orders/{order}/cancel', [OrderController::class, 'cancel']);

    // SHIPMENTS
    Route::apiResource('shipments', ShipmentController::class);

    // TRACKING
    Route::get(
        'shipments/{shipment}/tracking',
        [TrackingController::class, 'index']
    );

    Route::post(
        'shipments/{shipment}/tracking',
        [TrackingController::class, 'store']
    );

    // SHIPMENT EXCEPTIONS
    Route::get(
        'shipments/{shipment}/exceptions',
        [ExceptionController::class, 'index']
    );

    Route::post(
        'shipments/{shipment}/exceptions',
        [ExceptionController::class, 'store']
    );

    Route::patch(
        'exceptions/{exception}',
        [ExceptionController::class, 'update']
    );

    Route::get(
        'exceptions/{exception}/history',
        [ExceptionController::class, 'history']
    );

    // CARRIERS
    Route::get('carriers', [ResourceController::class, 'carriers']);
    Route::post('carriers', [ResourceController::class, 'storeCarrier']);

    // LOCATIONS
    Route::get('locations', [ResourceController::class, 'locations']);
    Route::post('locations', [ResourceController::class, 'storeLocation']);
    Route::put('locations/{location}', [ResourceController::class, 'updateLocation']);
    Route::delete('locations/{location}', [ResourceController::class, 'destroyLocation']);

    // LOGISTICS NEWS
    Route::get('news', [NewsController::class, 'index']);

});

// LOGIN FALLBACK
Route::get('login', fn () => response()->json([
    'message' => 'Unauthenticated.'
], 401))->name('login');
// CargoTrace Customer Notifications
Route::middleware('auth:sanctum')->group(function () {
    Route::get('notifications', [\App\Http\Controllers\Api\NotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [\App\Http\Controllers\Api\NotificationController::class, 'read']);
    Route::post('notifications/read-all', [\App\Http\Controllers\Api\NotificationController::class, 'readAll']);
    Route::delete('notifications/{notification}', [\App\Http\Controllers\Api\NotificationController::class, 'destroy']);
});
