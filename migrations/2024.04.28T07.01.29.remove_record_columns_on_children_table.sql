-- up migration
ALTER TABLE `children`
  DROP `weight`,
  DROP `length`,
  DROP `weight_recorded_at`;