-- up migration
ALTER TABLE `weight_records`
  MODIFY `weight` FLOAT NOT NULL,
  MODIFY `length` FLOAT NOT NULL;

ALTER TABLE `records`
  MODIFY `weight` FLOAT NOT NULL,
  MODIFY `length` FLOAT NOT NULL;