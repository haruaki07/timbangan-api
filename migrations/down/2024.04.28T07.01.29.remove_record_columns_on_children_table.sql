-- down migration
ALTER TABLE `children`
  ADD COLUMN `weight` INT AFTER `birth_place`,
  ADD COLUMN `length` INT AFTER `weight`,
  ADD COLUMN `weight_recorded_at` DATETIME AFTER `length`;