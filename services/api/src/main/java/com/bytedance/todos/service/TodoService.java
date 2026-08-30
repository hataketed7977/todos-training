package com.bytedance.todos.service;

import com.bytedance.todos.dto.CreateTodoRequest;
import com.bytedance.todos.dto.UpdateTodoRequest;
import com.bytedance.todos.model.TodoEntity;
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
	public List<TodoEntity> list() {
		return todoRepository.findAllByOrderByCreatedAtDesc();
	}

	@Transactional(readOnly = true)
	public List<TodoEntity> search(String title) {
		if (title != null) {
			String trimmed = title.trim();
			if (trimmed.isEmpty()) {
				return list();
			}
			return todoRepository.findByTitleContainingIgnoreCaseOrderByCreatedAtDesc(trimmed);
		}
		return list();
	}

	@Transactional
	public TodoEntity create(CreateTodoRequest request) {
		String description = normalizeBlankToNull(request.description());
		String assignee = normalizeBlankToNull(request.assignee());
		return todoRepository.save(new TodoEntity(request.title().trim(), description, request.priority(), assignee));
	}

	private static String normalizeBlankToNull(String value) {
		if (value == null) {
			return null;
		}
		String trimmed = value.trim();
		return trimmed.isEmpty() ? null : trimmed;
	}

	@Transactional
	public TodoEntity update(Long id, UpdateTodoRequest request) {
		TodoEntity todo = todoRepository.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found: " + id));
		todo.setTitle(request.title().trim());
		todo.setDescription(normalizeBlankToNull(request.description()));
		todo.setPriority(request.priority());
		// assignee 与 priority 同派：不传/空白/null 一律清空
		todo.setAssignee(normalizeBlankToNull(request.assignee()));
		if (request.status() != null) {
			todo.setStatus(request.status());
		}
		return todoRepository.save(todo);
	}

	@Transactional
	public void delete(Long id) {
		TodoEntity todo = todoRepository.findById(id)
				.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found: " + id));
		todoRepository.delete(todo);
	}
}
