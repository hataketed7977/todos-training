package com.example.todos.todo;

import jakarta.validation.Valid;
import java.util.List;
import java.util.NoSuchElementException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@CrossOrigin(origins = { "http://localhost:15173" })
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

	@PatchMapping("/{id}/status")
	public Todo updateStatus(
			@PathVariable Long id,
			@Valid @RequestBody UpdateTodoStatusRequest request
	) {
		return todoService.updateStatus(id, request.status());
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable Long id) {
		todoService.delete(id);
	}

	@ExceptionHandler(NoSuchElementException.class)
	public ResponseEntity<ErrorResponse> handleNotFound(NoSuchElementException exception) {
		return ResponseEntity.status(HttpStatus.NOT_FOUND)
				.body(new ErrorResponse(exception.getMessage()));
	}

	public record ErrorResponse(String message) {
	}
}
