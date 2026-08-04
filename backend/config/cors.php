<?php

/*
 * Origenes permitidos para la red local del hotel.
 * Ajuste FRONTEND_URL en .env con la IP fija del servidor.
 */
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_filter([
        env('FRONTEND_URL'),
        'http://localhost:5173',
    ]),
    // Permite cualquier equipo de la LAN 192.168.x.x (ajuste su segmento).
    'allowed_origins_patterns' => ['#^http://192\\.168\\.\\d+\\.\\d+(:\\d+)?$#'],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
