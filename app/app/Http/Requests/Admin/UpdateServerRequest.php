<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateServerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'branch' => ['sometimes', 'string', 'in:public,unstable,iwillbackupmysave'],
            'countdown' => ['sometimes', 'integer', 'min:10', 'max:3600'],
            'message' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}
