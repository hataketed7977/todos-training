package com.bytedance.todos.service;

import com.bytedance.todos.dto.CreateTodoRequest;
import com.bytedance.todos.model.Todo;
import com.bytedance.todos.repository.TodoRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
}
