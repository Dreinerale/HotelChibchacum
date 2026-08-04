<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', fn () => $this->comment('Buen servicio, buena estancia.'))
    ->purpose('Mensaje de cortesia');
