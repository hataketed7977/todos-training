package com.bytedance.todos.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateTodoRequest(
		@NotBlank String title
) {
}
