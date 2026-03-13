<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAutoRestartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'enabled' => ['sometimes', 'boolean'],
            'interval_hours' => ['sometimes', 'integer', Rule::in([2, 3, 4, 6, 8, 12, 24])],
            'warning_minutes' => ['sometimes', 'integer', Rule::in([2, 5, 10, 15, 30])],
            'warning_message' => ['sometimes', 'nullable', 'string', 'max:500'],
        ];
    }
}
