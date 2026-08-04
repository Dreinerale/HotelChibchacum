<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\UsuarioResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password as ReglaPassword;
use Illuminate\Validation\ValidationException;

/** Administracion de cuentas. Solo accesible para el rol administrador. */
class UsuarioController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return UsuarioResource::collection(User::orderBy('name')->get());
    }

    public function store(Request $request): UsuarioResource
    {
        $datos = $request->validate([
            'nombre' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'rol' => ['required', Rule::in(['administrador', 'recepcion'])],
            'activo' => ['boolean'],
            'password' => ['required', ReglaPassword::min(8)],
        ]);

        $usuario = User::create([
            'name' => $datos['nombre'],
            'email' => $datos['email'],
            'rol' => $datos['rol'],
            'activo' => $datos['activo'] ?? true,
            'password' => $datos['password'],
        ]);

        return new UsuarioResource($usuario);
    }

    public function update(Request $request, User $usuario): UsuarioResource
    {
        $datos = $request->validate([
            'nombre' => ['sometimes', 'string', 'max:120'],
            'rol' => ['sometimes', Rule::in(['administrador', 'recepcion'])],
            'activo' => ['sometimes', 'boolean'],
        ]);

        $usuario->update(array_filter([
            'name' => $datos['nombre'] ?? null,
            'rol' => $datos['rol'] ?? null,
        ], fn ($v) => $v !== null) + (
            array_key_exists('activo', $datos) ? ['activo' => $datos['activo']] : []
        ));

        return new UsuarioResource($usuario->fresh());
    }

    public function destroy(Request $request, User $usuario): JsonResponse
    {
        if ($usuario->id === $request->user()->id) {
            throw ValidationException::withMessages(['id' => 'No puede eliminar su propia cuenta.']);
        }

        if ($usuario->esAdministrador() && User::where('rol', 'administrador')->count() === 1) {
            throw ValidationException::withMessages(['id' => 'Debe existir al menos un administrador.']);
        }

        $usuario->delete();

        return response()->json(null, 204);
    }
}
