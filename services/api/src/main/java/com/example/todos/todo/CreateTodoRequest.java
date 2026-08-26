package com.example.todos.todo;

import jakarta.validation.constraints.NotBlank;

public record CreateTodoRequest(
		@NotBlank String title,
		String description,
		TodoPriority priority
) {
}
