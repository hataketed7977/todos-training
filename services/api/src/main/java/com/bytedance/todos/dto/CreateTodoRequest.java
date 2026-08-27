package com.bytedance.todos.dto;

import com.bytedance.todos.model.TodoPriority;
import jakarta.validation.constraints.NotBlank;

public record CreateTodoRequest(
		@NotBlank String title,
		String description,
		TodoPriority priority
) {
}
