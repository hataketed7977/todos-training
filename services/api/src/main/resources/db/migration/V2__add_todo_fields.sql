ALTER TABLE todos ADD COLUMN description VARCHAR(2000);
ALTER TABLE todos ADD COLUMN priority VARCHAR(255);
ALTER TABLE todos ADD CONSTRAINT chk_todos_priority
    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'));
