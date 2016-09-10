#! /usr/bin/env python
# MailChimp integration

import lyf, logging
from lyf import psql

from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

def main():
	try:
		lists = lyf.get_mc_lists()
		db = psql.DB()
		i = 0
		for list in lists:
			# Fetch current totals
			yesterday = db.query("select * from d_mc_lists where list_id = '%s'" % list.list_id)

			# Update snapshot fact
			rec = {}
			rec['date_id'] = date.today().strftime('%Y%m%d')
			rec['list_id'] = list.list_id
			rec['open_rate'] = list.open_rate
			rec['avg_sub_rate'] = list.avg_sub_rate
			rec['total_members'] = list.total_members
			rec['total_unsubscribed'] = list.total_unsubscribed
			rec['total_cleaned'] = list.total_cleaned
			rec['total_campaigns'] = list.total_campaigns

			if len(yesterday) > 0:
				rec['members'] = list.total_members - yesterday[0]['total_members']
				rec['unsubscribed'] = list.total_unsubscribed - yesterday[0]['total_unsubscribed']
				rec['cleaned'] = list.total_cleaned - yesterday[0]['total_cleaned']
			else:
				rec['members'] = 0
				rec['unsubscribed'] = 0
				rec['cleaned'] = 0

			db.upsert('f_mc_lists_daily', rec, ['list_id']) # Update snapshot fact
			db.upsert('d_mc_lists', list.__dict__, ['list_id']) # Update dimension

			i += 1
		db.close()
		logging.info('Merged %s rows into d_mc_lists and f_mc_lists_daily.' % i)
	except Exception as err:
		logging.error(err)

if __name__ == '__main__':
	main()
