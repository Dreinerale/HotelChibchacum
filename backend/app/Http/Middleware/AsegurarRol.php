<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restringe rutas segun el rol del usuario autenticado.
 * Uso: ->middleware('rol:administrador')
 */
class AsegurarRol
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $usuario = $request->user();

        if (! $usuario || ! $usuario->activo || ! in_array($usuario->rol, $roles, true)) {
            return response()->json(['message' => 'No tiene permisos para esta accion.'], 403);
        }

        return $next($request);
    }
}
