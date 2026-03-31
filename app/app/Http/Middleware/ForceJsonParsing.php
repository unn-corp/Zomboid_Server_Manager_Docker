<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ensure JSON request bodies are parsed for API routes.
 *
 * Some reverse proxies (Dokploy, Nginx) can strip or modify the Content-Type
 * header, preventing Laravel from auto-detecting JSON bodies. This middleware
 * forces JSON parsing when the body looks like JSON.
 */
class ForceJsonParsing
{
    public function handle(Request $request, Closure $next): Response
    {
        // If the request has a body that looks like JSON but wasn't parsed,
        // force Laravel to treat it as JSON
        if ($request->getContent() !== '' && $request->input() === []) {
            $content = $request->getContent();
            if (str_starts_with(trim($content), '{') || str_starts_with(trim($content), '[')) {
                $request->merge((array) json_decode($content, true));
            }
        }

        return $next($request);
    }
}
