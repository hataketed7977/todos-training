package com.example.todos.todo;

public record UpdateTodoRequest(
		String title,
		String description,
		TodoPriority priority
) {
}
