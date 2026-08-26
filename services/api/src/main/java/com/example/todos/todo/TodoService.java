package com.example.todos.todo;

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
		return todoRepository.save(new Todo(
				request.title().trim(),
				blankToNull(request.description()),
				request.priority()
		));
	}

	@Transactional
	public Todo update(Long id, UpdateTodoRequest request) {
		var todo = find(id);
		if (request.title() != null && !request.title().isBlank()) {
			todo.setTitle(request.title().trim());
		}
		if (request.description() != null) {
			todo.setDescription(blankToNull(request.description()));
		}
		if (request.priority() != null) {
			todo.setPriority(request.priority());
		}
		return todo;
	}

	@Transactional
	public Todo updateStatus(Long id, TodoStatus status) {
		var todo = find(id);
		todo.setStatus(status);
		return todo;
	}

	@Transactional
	public void delete(Long id) {
		if (!todoRepository.existsById(id)) {
			throw new NoSuchElementException("Todo not found: " + id);
		}
		todoRepository.deleteById(id);
	}

	private Todo find(Long id) {
		return todoRepository.findById(id)
				.orElseThrow(() -> new NoSuchElementException("Todo not found: " + id));
	}

	private String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}
}
