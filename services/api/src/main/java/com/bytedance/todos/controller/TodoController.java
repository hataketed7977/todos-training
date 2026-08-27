package com.bytedance.todos.controller;

import com.bytedance.todos.dto.CreateTodoRequest;
import com.bytedance.todos.dto.UpdateTodoRequest;
import com.bytedance.todos.model.Todo;
import com.bytedance.todos.service.TodoService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/todos")
public class TodoController {
	private final TodoService todoService;

	public TodoController(TodoService todoService) {
		this.todoService = todoService;
	}

	@GetMapping
	public List<Todo> list() {
		return todoService.list();
	}

	@GetMapping("/{id}")
	public Todo get(@PathVariable Long id) {
		return todoService.get(id);
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public Todo create(@Valid @RequestBody CreateTodoRequest request) {
		return todoService.create(request);
	}

	@PatchMapping("/{id}")
	public Todo update(@PathVariable Long id, @RequestBody UpdateTodoRequest request) {
		return todoService.update(id, request);
	}

	@ExceptionHandler(NoSuchElementException.class)
	public ResponseEntity<ErrorResponse> handleNotFound(NoSuchElementException exception) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
				.body(new ErrorResponse(exception.getMessage()));
	}

	public record ErrorResponse(String message) {
	}
}
