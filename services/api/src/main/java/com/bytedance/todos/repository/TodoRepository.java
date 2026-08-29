package com.bytedance.todos.repository;

import com.bytedance.todos.model.Todo;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TodoRepository extends JpaRepository<Todo, Long> {
	List<Todo> findAllByOrderByCreatedAtDesc();
	List<Todo> findByTitleContainingIgnoreCaseOrderByCreatedAtDesc(String title);
}
