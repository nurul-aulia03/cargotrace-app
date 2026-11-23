<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $r)
    {
        $d = $r->validate(['name' => 'required|string|max:100', 'email' => 'required|email|unique:users,email', 'password' => 'required|string|min:8|confirmed']);
        $u = User::create($d); // role is never mass-assigned: new accounts are always "customer"
        return response()->json(['user' => $u->fresh(), 'token' => $u->createToken('api')->plainTextToken], 201);
    }

    public function login(Request $r)
    {
        $d = $r->validate(['email' => 'required|email', 'password' => 'required|string']);
        $u = User::where('email', $d['email'])->first();
        if (!$u || !Hash::check($d['password'], $u->password)) {
            return response()->json(['message' => 'Invalid credentials.'], 401);
        }
        return response()->json(['user' => $u, 'token' => $u->createToken('api')->plainTextToken]);
    }

    public function logout(Request $r)
    {
        $r->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function user(Request $r) { return $r->user(); }
}
