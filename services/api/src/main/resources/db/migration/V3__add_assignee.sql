ALTER TABLE todos ADD COLUMN assignee VARCHAR(255);
ALTER TABLE todos ADD CONSTRAINT chk_todos_assignee_length
    CHECK (LENGTH(assignee) <= 255);
