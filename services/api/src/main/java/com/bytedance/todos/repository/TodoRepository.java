package com.bytedance.todos.repository;

import com.bytedance.todos.model.TodoEntity;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TodoRepository extends JpaRepository<TodoEntity, Long> {
	List<TodoEntity> findAllByOrderByCreatedAtDesc();
	List<TodoEntity> findByTitleContainingIgnoreCaseOrderByCreatedAtDesc(String title);
}
