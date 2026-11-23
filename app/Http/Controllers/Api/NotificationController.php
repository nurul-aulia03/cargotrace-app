<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(
            $request->user()->notifications()->latest()->paginate(30)
        );
    }

    public function read(Request $request, string $notification)
    {
        $item = $request->user()->notifications()
            ->whereKey($notification)->firstOrFail();

        $item->markAsRead();

        return response()->json([
            'message' => 'Notifikasi ditandai sudah dibaca.',
            'notification' => $item,
        ]);
    }

    public function readAll(Request $request)
    {
        $request->user()->unreadNotifications()
            ->update(['read_at' => now()]);

        return response()->json([
            'message' => 'Semua notifikasi sudah dibaca.',
        ]);
    }

    public function destroy(Request $request, string $notification)
    {
        $item = $request->user()->notifications()
            ->whereKey($notification)->firstOrFail();

        $item->delete();

        return response()->json([
            'message' => 'Notifikasi berhasil dihapus.',
        ]);
    }
}