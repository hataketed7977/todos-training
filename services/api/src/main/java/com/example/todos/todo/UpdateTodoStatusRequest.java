package com.example.todos.todo;

import jakarta.validation.constraints.NotNull;

public record UpdateTodoStatusRequest(@NotNull TodoStatus status) {
}
