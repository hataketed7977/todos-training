package com.bytedance.todos.service;

import com.bytedance.todos.dto.CreateTodoRequest;
import com.bytedance.todos.dto.UpdateTodoRequest;
import com.bytedance.todos.model.Todo;
import com.bytedance.todos.repository.TodoRepository;
import java.util.List;
import java.util.NoSuchElementException;
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

	@Transactional(readOnly = true)
	public Todo get(Long id) {
		return find(id);
	}

	@Transactional
	public Todo create(CreateTodoRequest request) {
		return todoRepository.save(new Todo(request.title().trim()));
	}

	@Transactional
	public Todo update(Long id, UpdateTodoRequest request) {
		var todo = find(id);
		if (request.title() != null && !request.title().isBlank()) {
			todo.setTitle(request.title().trim());
		}
		return todo;
	}

	private Todo find(Long id) {
		return todoRepository.findById(id)
				.orElseThrow(() -> new NoSuchElementException("Todo not found: " + id));
	}
}
