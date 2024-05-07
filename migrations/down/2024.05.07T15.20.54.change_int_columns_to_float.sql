-- down migration
ALTER TABLE `weight_records`
  MODIFY `weight` INT NOT NULL,
  MODIFY `length` INT NOT NULL;

ALTER TABLE `records`
  MODIFY `weight` INT NOT NULL,
  MODIFY `length` INT NOT NULL;