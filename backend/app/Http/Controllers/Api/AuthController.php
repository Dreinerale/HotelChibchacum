<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\UsuarioResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as ReglaPassword;
use Illuminate\Validation\ValidationException;

/**
 * Autenticacion por tokens Sanctum: login, logout, perfil, recuperacion y
 * cambio de contrasena. Todas las contrasenas se guardan con hash bcrypt.
 */
class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $usuario = User::where('email', $datos['email'])->first();

        if (! $usuario || ! Hash::check($datos['password'], $usuario->password)) {
            throw ValidationException::withMessages([
                'email' => 'Credenciales incorrectas. Verifique correo y contrasena.',
            ]);
        }

        if (! $usuario->activo) {
            throw ValidationException::withMessages([
                'email' => 'La cuenta esta inactiva. Contacte al administrador.',
            ]);
        }

        // Un token por dispositivo; se revocan los anteriores del mismo equipo.
        $usuario->tokens()->where('name', 'pms')->delete();

        return response()->json([
            'usuario' => new UsuarioResource($usuario),
            'token' => $usuario->createToken('pms')->plainTextToken,
        ]);
    }

    public function me(Request $request): UsuarioResource
    {
        return new UsuarioResource($request->user());
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesion cerrada.']);
    }

    /**
     * Genera un token de recuperacion. Con MAIL_MAILER=log (hotel sin
     * Internet) el enlace queda registrado en storage/logs/laravel.log.
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        $estado = Password::sendResetLink($request->only('email'));

        if ($estado !== Password::RESET_LINK_SENT) {
            throw ValidationException::withMessages([
                'email' => 'No existe una cuenta con ese correo.',
            ]);
        }

        return response()->json(['message' => 'Se envio el codigo de recuperacion.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', ReglaPassword::min(8)],
        ]);

        $estado = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $usuario, string $clave) {
                $usuario->forceFill([
                    'password' => $clave,
                    'remember_token' => Str::random(60),
                ])->save();

                $usuario->tokens()->delete();
            }
        );

        if ($estado !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'token' => 'El codigo de recuperacion no es valido o expiro.',
            ]);
        }

        return response()->json(['message' => 'Contrasena actualizada.']);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'confirmed', ReglaPassword::min(8)],
        ]);

        $usuario = $request->user();

        if (! Hash::check($request->input('current_password'), $usuario->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'La contrasena actual no es correcta.',
            ]);
        }

        $usuario->update(['password' => $request->input('password')]);

        return response()->json(['message' => 'Contrasena actualizada.']);
    }
}
