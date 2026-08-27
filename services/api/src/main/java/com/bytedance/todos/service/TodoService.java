package com.bytedance.todos.service;

import com.bytedance.todos.dto.CreateTodoRequest;
import com.bytedance.todos.dto.UpdateTodoRequest;
import com.bytedance.todos.model.Todo;
import com.bytedance.todos.repository.TodoRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TodoService {
	private final TodoRepository todoRepository;

	public TodoService(TodoRepository todoRepository) {
		this.todoRepository = todoRepository;
	}

	@Transactional(readOnly = true)
	public List<Todo> list() {
		return todoRepository.findAllByOrderByCreatedAtDesc();
	}

	@Transactional
	public Todo create(CreateTodoRequest request) {
		String description = request.description();
		if (description != null) {
			description = description.trim();
			if (description.isBlank()) {
				description = null;
			}
		}
		return todoRepository.save(new Todo(request.title().trim(), description, request.priority()));
	}

	@Transactional
	public Todo update(Long id, UpdateTodoRequest request) {
		Todo todo = todoRepository.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found: " + id));
		todo.setTitle(request.title().trim());
		String description = request.description();
		if (description != null) {
			description = description.trim();
			if (description.isBlank()) {
				description = null;
			}
		}
		todo.setDescription(description);
		todo.setPriority(request.priority());
		return todoRepository.save(todo);
	}

	@Transactional
	public void delete(Long id) {
		Todo todo = todoRepository.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found: " + id));
		todoRepository.delete(todo);
	}
}
